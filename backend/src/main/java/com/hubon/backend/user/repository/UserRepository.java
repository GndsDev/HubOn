package com.hubon.backend.user.repository;

import com.hubon.backend.user.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("select user from User user where lower(user.username) = lower(:username)")
    Optional<User> findByUsernameIgnoreCase(@Param("username") String username);

    @Query("select count(user) > 0 from User user where lower(user.username) = lower(:username)")
    boolean existsByUsernameIgnoreCase(@Param("username") String username);
}
